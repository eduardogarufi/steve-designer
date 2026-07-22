interface FancyPanelProps {
  tone?: string;
  dense?: boolean;
}

export function FancyPanel({ tone, dense }: FancyPanelProps) {
  return <section data-tone={tone} data-dense={dense} />;
}

export const GlassCard = (props: { title: string }) => <div>{props.title}</div>;
