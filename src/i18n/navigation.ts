import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Обёртки над next/link и next/navigation, которые сами подставляют текущую
 * локаль в адрес. Импортировать их вместо родных — иначе переходы будут
 * сбрасывать язык на дефолтный.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
