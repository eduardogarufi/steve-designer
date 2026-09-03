export function Clean({ t }: { t: (k: string) => string }) { return <section><h1>{t("clean.title")}</h1><input placeholder={t("clean.name.placeholder")} /><span>42</span><span>·</span></section>; }
