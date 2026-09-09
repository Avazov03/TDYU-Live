import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./auth.module.css";
import { BRAND } from "@/lib/brand";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.wrapper}>
        <Link href="/" className={styles.brand}>
          {BRAND.name}
        </Link>
        {children}
      </div>
    </div>
  );
}
