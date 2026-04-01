import React from 'react';
import Layout from '@theme-original/DocItem/Layout';
import type { Props } from '@theme/DocItem/Layout';
import ExportPDF from '@site/src/components/ExportPDF';

/**
 * Swizzle wrapper around DocItem/Layout.
 * Renders ExportPDF here (inside DocsSidebarProvider) instead of Root.tsx (outside it).
 */
export default function LayoutWrapper(props: Props): React.ReactElement {
  return (
    <>
      <Layout {...props} />
      <ExportPDF />
    </>
  );
}
