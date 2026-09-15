import { useMemo } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

/**
 * The description editor — the same component, toolbar and formats as the
 * website's agent upload form, so a description written here renders on the
 * public listing exactly as one written there. The server sanitises the HTML
 * before it is stored.
 */

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
}

const FORMATS = ['header', 'bold', 'italic', 'underline', 'list', 'link']

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write a description…',
  className = '',
}: Props) {
  // Memoised: a new modules object on every render makes Quill re-initialise
  // and drop focus mid-typing.
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
      clipboard: { matchVisual: false },
    }),
    [],
  )

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={FORMATS}
        placeholder={placeholder}
      />
    </div>
  )
}
