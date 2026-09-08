import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const FeatureList = [
  {
    number: '01',
    title: 'Technology Fundamentals',
    description:
      'Understand the foundations behind modern technology — email systems, networking, DNS, protocols, routing, and the infrastructure that powers the internet.',
    link: '/docs/category/technology-fundamentals/',
  },
  {
    number: '02',
    title: 'Programming Languages',
    description:
      'Build strong programming fundamentals with C++, JavaScript, asynchronous programming, closures, functional programming, and advanced language concepts.',
    link: '/docs/category/programming/',
  },
  {
    number: '03',
    title: 'System Design',
    description:
      'Learn how large-scale systems are designed. Explore architecture, scalability, reliability, distributed systems, HLD, and LLD.',
    link: '/docs/category/hld/',
  },
  {
    number: '04',
    title: 'Databases',
    description:
      'Understand how data is stored, queried, indexed, modeled, and optimized across SQL and NoSQL database systems.',
    link: '/docs/category/database/',
  },
  {
    number: '05',
    title: 'DSA & Algorithms',
    description:
      'Develop strong problem-solving skills through data structures, algorithms, complexity analysis, and practical implementations.',
    link: '/docs/category/dsa/',
  },
  {
    number: '06',
    title: 'DevOps & Deployment',
    description:
      'Learn how software reaches production through containers, CI/CD, deployment strategies, infrastructure, and modern DevOps practices.',
    link: '/docs/category/deployment/',
  },
];

function Feature({ number, title, description, link }) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <Link to={link} className={styles.featureCard}>
        <div className={styles.featureTop}>
          <span className={styles.featureNumber}>{number}</span>
          <span className={styles.arrow}>↗</span>
        </div>

        <div className={styles.featureContent}>
          <h3 className={styles.featureTitle}>{title}</h3>
          <p className={styles.featureDescription}>{description}</p>
        </div>

        <div className={styles.featureFooter}>
          <span>Explore topic</span>
          <span className={styles.footerArrow}>→</span>
        </div>
      </Link>
    </div>
  );
}

const LearningPaths = [
  {
    number: '01',
    title: 'Start from the beginning',
    description:
      'Build a strong foundation in programming and computer science.',
    link: '/docs/category/c-programming/',
  },
  {
    number: '02',
    title: 'Understand how technology works',
    description:
      'Go beneath the surface and understand the systems behind modern technology.',
    link: '/docs/category/technology-fundamentals/',
  },
  {
    number: '03',
    title: 'Design systems at scale',
    description:
      'Learn how experienced engineers think about architecture, scalability and reliability.',
    link: '/docs/category/hld/',
  },
];

function LearningPathCard({ number, title, description, link }) {
  return (
    <div className={styles.pathCard}>
      <Link to={link} className={styles.pathLink}>
        <div className={styles.pathNumber}>{number}</div>

        <div className={styles.pathContent}>
          <h3 className={styles.pathTitle}>{title}</h3>
          <p className={styles.pathDescription}>{description}</p>
        </div>

        <span className={styles.pathArrow}>↗</span>
      </Link>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <>
      {/* Topics */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>THE KNOWLEDGE BASE</span>
              <h2 className={styles.sectionTitle}>
                Learn the things
                <br />
                that matter.
              </h2>
            </div>

            <p className={styles.sectionSubtitle}>
              A structured collection of engineering knowledge designed to
              help you understand technology deeply — not just use it.
            </p>
          </div>

          <div className="row">
            {FeatureList.map((feature) => (
              <Feature key={feature.number} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Learning paths */}
      <section className={styles.learningPaths}>
        <div className="container">
          <div className={styles.pathHeader}>
            <div>
              <span className={styles.eyebrow}>WHERE TO BEGIN</span>
              <h2 className={styles.sectionTitle}>
                Choose your
                <br />
                direction.
              </h2>
            </div>

            <p className={styles.sectionSubtitle}>
              Whether you're starting out or preparing to design systems at
              scale, follow a path that matches where you are today.
            </p>
          </div>

          <div className={styles.pathsGrid}>
            {LearningPaths.map((path) => (
              <LearningPathCard key={path.number} {...path} />
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className={styles.philosophy}>
        <div className="container">
          <div className={styles.philosophyHeader}>
            <span className={styles.eyebrow}>THE APPROACH</span>

            <h2 className={styles.philosophyTitle}>
              Don't just learn
              <br />
              <span>what.</span> Understand <span>why.</span>
            </h2>

            <p className={styles.philosophyIntro}>
              Good engineering starts with understanding. Every concept is
              approached from first principles and connected to how it is
              actually used in production.
            </p>
          </div>

          <div className={styles.philosophyGrid}>
            <div className={styles.philosophyItem}>
              <span>01</span>
              <h3>Start simple</h3>
              <p>
                Complex engineering concepts explained without unnecessary
                jargon.
              </p>
            </div>

            <div className={styles.philosophyItem}>
              <span>02</span>
              <h3>Build progressively</h3>
              <p>
                Concepts are introduced in an order that creates a strong
                mental model.
              </p>
            </div>

            <div className={styles.philosophyItem}>
              <span>03</span>
              <h3>Think practically</h3>
              <p>
                Connect theory with real systems, engineering decisions and
                production problems.
              </p>
            </div>

            <div className={styles.philosophyItem}>
              <span>04</span>
              <h3>Go deeper</h3>
              <p>
                Move beyond tutorials and understand what happens underneath
                the abstractions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className="container">
          <div className={styles.ctaContent}>
            <span className={styles.eyebrow}>START LEARNING</span>

            <h2 className={styles.ctaTitle}>
              Build knowledge
              <br />
              that compounds.
            </h2>

            <p className={styles.ctaSubtitle}>
              Explore engineering fundamentals, programming, databases,
              system design and everything in between.
            </p>

            <div className={styles.ctaButtons}>
              <Link
                className="button button--primary button--lg"
                to="/docs/intro"
              >
                Explore the knowledge base
                <span>→</span>
              </Link>

              {/* <Link
                className="button button--outline button--lg"
                to="/docs/category/technology-fundamentals/"
              >
                Start with fundamentals
              </Link> */}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}