import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>ENGINEERING KNOWLEDGE BASE</span>

          <h1 className={styles.heroTitle}>
            Learn technology
            <br />
            from first principles.
          </h1>

          <p className={styles.heroDescription}>
            A comprehensive knowledge base covering programming, system design, databases,
            algorithms, and the engineering fundamentals that power modern technology.
          </p>

          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/docs/intro">
              Explore the knowledge base
              <span>→</span>
            </Link>
            {/* <Link
              className="button button--outline button--lg"
              to="/docs/category/technology-fundamentals/">
              Start with fundamentals
            </Link> */}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="A comprehensive technical knowledge base covering programming fundamentals, technology deep-dives, system design, and software engineering best practices">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
