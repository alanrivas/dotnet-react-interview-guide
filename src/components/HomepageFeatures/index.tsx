import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  emoji: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '🟢 Junior',
    emoji: '🟢',
    description: (
      <>
        20 documentos cubriendo C#, .NET, React, SQL y fundamentos de
        arquitectura. Ideal para tu primera entrevista técnica.
      </>
    ),
  },
  {
    title: '🟡 Semi-Senior',
    emoji: '🟡',
    description: (
      <>
        27 documentos sobre patrones de diseño, Entity Framework, TypeScript,
        testing y APIs REST con autenticación JWT.
      </>
    ),
  },
  {
    title: '🔴 Senior',
    emoji: '🔴',
    description: (
      <>
        48 documentos sobre arquitectura de microservicios, DDD, CQRS,
        performance, seguridad y liderazgo técnico.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
