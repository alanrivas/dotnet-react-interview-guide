import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import TextToSpeech from '@site/src/components/TextToSpeech';

export default function Root({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {children}
      <TextToSpeech />
      {/* ExportPDF uses useDocsSidebar which requires browser context (not SSR-safe) */}
      <BrowserOnly>{() => {
        const ExportPDF = require('@site/src/components/ExportPDF').default;
        return <ExportPDF />;
      }}</BrowserOnly>
    </>
  );
}
