/**
 * Клиент эмбеддингов Voyage.
 *
 * Почему Voyage, а не OpenAI: каталог описан по-русски, а у Voyage на
 * мультиязычном ретривале заметно лучше — и 200 миллионов токенов даются
 * бесплатно, чего хватает примерно на 90 полных перегонов каталога. Это
 * важнее цены: подбор состава эмбеддинга — это и есть много перегонов подряд.
 */
import { EMBEDDING_MODEL } from "./embedding-text";
import { VECTOR_DIMENSIONS } from "./vector";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

/**
 * API берёт до 1000 текстов за раз, но большими пачками мы теряем на повторах:
 * одна сетевая ошибка отправляет всю пачку заново. 128 — компромисс между
 * числом запросов и ценой промаха.
 */
const BATCH_SIZE = 128;

/** Сколько пачек летит одновременно. Лимит тарифа — 2000 запросов в минуту. */
const CONCURRENCY = 4;

const MAX_RETRIES = 4;

/**
 * Voyage разделяет роли текста и подмешивает разную инструкцию перед
 * векторизацией: документ описывает себя, запрос описывает то, что ищет.
 * Оба вектора живут в одном пространстве, но с ролями они ближе по смыслу,
 * чем без них, — поэтому каталог всегда document, а строка поиска query.
 */
export type InputType = "document" | "query";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
};

function apiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("нет VOYAGE_API_KEY — положи ключ в .env");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Токены, потраченные с начала процесса, — чтобы видеть расход бесплатной квоты. */
let tokensUsed = 0;
export const usedTokens = () => tokensUsed;

async function embedBatch(texts: string[], inputType: InputType): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: VECTOR_DIMENSIONS,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as VoyageResponse;
      tokensUsed += json.usage.total_tokens;
      // Порядок в ответе не гарантирован — раскладываем по index, иначе
      // вектора молча разъедутся по чужим тайтлам.
      const out: number[][] = new Array(texts.length);
      for (const row of json.data) out[row.index] = row.embedding;
      return out;
    }

    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= MAX_RETRIES) {
      throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    await sleep(1000 * 2 ** attempt);
  }
}

/** Векторизует список текстов, сохраняя порядок. */
export async function embedTexts(
  texts: string[],
  inputType: InputType,
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const batches: { at: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push({ at: i, texts: texts.slice(i, i + BATCH_SIZE) });
  }

  const result: number[][] = new Array(texts.length);
  let done = 0;
  let next = 0;

  // Пул воркеров вместо Promise.all по всем пачкам: так одновременно в полёте
  // ровно CONCURRENCY запросов, а не все 90 сразу.
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        const vectors = await embedBatch(batch.texts, inputType);
        for (let i = 0; i < vectors.length; i++) result[batch.at + i] = vectors[i];
        done += batch.texts.length;
        onProgress?.(done, texts.length);
      }
    }),
  );

  return result;
}

/** Векторизует одну поисковую строку. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], "query");
  return vector;
}
