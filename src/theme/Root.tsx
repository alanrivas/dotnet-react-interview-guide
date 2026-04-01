import React from 'react';
import TextToSpeech from '@site/src/components/TextToSpeech';

/**
 * ExportPDF is NOT here — it lives in src/theme/DocItem/Layout/index.tsx,
 * which renders inside DocsSidebarProvider (required by useDocsSidebar).
 */
export default function Root({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {children}
      <TextToSpeech />
    </>
  );
}
