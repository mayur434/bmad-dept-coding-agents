import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

function Feature({emoji, title, description}) {
  return (
    <div className="col col--4 dca-feature">
      <h3>
        <span className="dca-feature-emoji" aria-hidden="true">{emoji}</span>
        {title}
      </h3>
      <p>{description}</p>
    </div>
  );
}

const FEATURES = [
  {
    emoji: '🔍',
    title: 'Audit',
    description:
      'Deterministic tree-sitter AST + regex scan + LLM deep analysis across 8 stacks.',
  },
  {
    emoji: '🛡️',
    title: 'Sonar Scan',
    description:
      'Bugs, vulnerabilities, hotspots, smells + Quality Gate + A–E ratings.',
  },
  {
    emoji: '⚡',
    title: 'Code Generation',
    description:
      '29 scaffolders + MCP auto-provisioning + security hardening.',
  },
  {
    emoji: '💥',
    title: 'Impact Analysis',
    description:
      'Bug/BRD/PR-diff-driven blast radius with CODEOWNERS + cross-agent enrichment.',
  },
  {
    emoji: '🧪',
    title: 'Test Coverage',
    description:
      'Gap analysis + JaCoCo/Istanbul/Clover/LCOV + mutation testing hooks.',
  },
  {
    emoji: '🎯',
    title: 'Role-Adapted',
    description:
      '10 roles change default mode, output flavor, and follow-up chain per agent.',
  },
];

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <header className="hero hero--primary dca-hero">
        <div className="container">
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className="dca-hero-cta">
            <Link
              className="button button--secondary button--lg"
              to="/getting-started/install"
            >
              Get Started – 5 min ⏱️
            </Link>
            <Link
              className="button button--outline button--lg dca-hero-cta-secondary"
              to="/concepts/the-5-agents"
            >
              Explore the 5 Agents
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="dca-features">
          <div className="container">
            <div className="row">
              {FEATURES.map((f) => (
                <Feature key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
