import useDocumentMeta from '../../hooks/useDocumentMeta';

/** Sets page title and meta tags from admin company settings + route. */
export default function DocumentMeta(props) {
  useDocumentMeta(props);
  return null;
}
