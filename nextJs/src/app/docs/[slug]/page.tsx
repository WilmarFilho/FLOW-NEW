import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDocBySlug } from '@/lib/docsData';
import styles from '@/components/docs/Docs.module.css';

interface DocPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const doc = getDocBySlug(params.slug);
  return {
    title: doc ? `${doc.title} | FLOW Docs` : 'Document não encontrado',
  };
}

export default function DocPage({ params }: DocPageProps) {
  const doc = getDocBySlug(params.slug);

  if (!doc) {
    notFound();
  }

  // A simple markdown renderer just for demonstration. 
  // For production, you could use a library like react-markdown.
  const renderMarkdownText = (text: string) => {
    const lines = text.trim().split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return <h1 key={idx}>{trimmed.substring(2)}</h1>;
      } else if (trimmed.startsWith('## ')) {
        return <h2 key={idx}>{trimmed.substring(3)}</h2>;
      } else if (trimmed.startsWith('### ')) {
        return <h3 key={idx}>{trimmed.substring(4)}</h3>;
      } else if (trimmed.startsWith('- ')) {
        const parseBold = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <ul key={idx}><li dangerouslySetInnerHTML={{ __html: parseBold }} /></ul>;
      } else if (trimmed.startsWith('> ')) {
        return <blockquote key={idx}>{trimmed.substring(2)}</blockquote>;
      } else if (trimmed.length === 0) {
        return <br key={idx} />;
      } else {
        const parseBold = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <p key={idx} dangerouslySetInnerHTML={{ __html: parseBold }} />;
      }
    });
  };

  return (
    <article className={`${styles.article} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {renderMarkdownText(doc.content)}
    </article>
  );
}
