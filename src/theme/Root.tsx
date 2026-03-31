import React from 'react';
import TextToSpeech from '@site/src/components/TextToSpeech';

export default function Root({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {children}
      <TextToSpeech />
    </>
  );
}
