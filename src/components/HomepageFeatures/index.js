import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

export default function HomepageFeatures() {
  const cardStyle = {
    padding: '4px',
    minWidth: '200px',
    backgroundColor: 'whitesmoke',
    borderRadius: '5px',
    margin: '.5rem',
    color: 'black'

  }
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className="text--center">
          <div style={{ display: 'flex', flexDirection: 'column', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '32px' }}>
                Welcome to <span style={{ color: '#7064f3' }}>Tech Notebook!</span>
            </div>
            <div style={{ fontWeight: 500 }}>
              Your Premier Tech Guide for Software Development.
            </div>
            <div style={{ marginTop: '1.5rem', maxWidth: '800px', textAlign: 'justify', fontStyle: 'italic' }}>
                A top-notch tech guide designed to elevate your software development journey. Whether you're a seasoned engineer or just starting your coding odyssey, Tech Notebook covers concepts that are relevant and applicable across programming languages and stacks.
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: '1rem', justifyContent: 'space-evenly', alignItems: 'center' }}>
              <div style={cardStyle}>JavaScript</div>
              <div style={cardStyle}>DSA</div>
              <div style={cardStyle}>Database</div>
              <div style={cardStyle}>Deployment</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
