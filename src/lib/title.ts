import { useEffect } from 'react'

/**
 * The tab title.
 *
 * Staff work this portal with several tabs open — deals in one, the daily log
 * in another — and a row of identical "PropertyLoop — Team" tabs is unusable.
 * The section name goes first because that is the part still visible once the
 * browser has shrunk the tab to a thumbnail.
 */

const SUFFIX = 'PropertyLoop Team'

export function useDocumentTitle(section?: string) {
  useEffect(() => {
    document.title = section ? `${section} · ${SUFFIX}` : SUFFIX
  }, [section])
}
