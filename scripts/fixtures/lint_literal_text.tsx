import { Button } from "@/components/ui/button";
export function Panel({ t }: { t: (k: string) => string }) {
  const label = "not jsx text, just a variable";
  return <section><h1>Painel de controle</h1><input placeholder="Digite o nome" /><Button aria-label="Fechar painel" variant="ghost" /><span>{t("panel.footer.note")}</span><span>—</span><span>{label}</span><p>Don't panic</p></section>;
}
