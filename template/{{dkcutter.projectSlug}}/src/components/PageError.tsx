{% if not dkcutter.useAppFolder -%}
import Head from "next/head";
{% endif -%}
import Link from "next/link";

interface PageErrorProps {
  readonly title: string;
  readonly description: string;
}

export function PageError({ title, description }: PageErrorProps) {
  return (
    <main className="flex h-screen flex-col items-center justify-center text-center">
      {%- if not dkcutter.useAppFolder %}
      <Head>
        <title>{title}</title>
      </Head>
      {%- endif %}
      <h1 className="text-4xl font-bold tracking-wide">{title}</h1>
      <p className="mt-4 text-lg">{description}</p>
      <p className="mt-2 text-base">
        Go back to the <Link href="/">home</Link>.
      </p>
    </main>
  );
}
