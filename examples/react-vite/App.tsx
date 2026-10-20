import { useState } from 'react';
import { useFuriIME, type UseFuriIMEOptions } from 'furi-ime/react';

export default function App() {
  const [katakana, setKatakana] = useState(false);
  const options: UseFuriIMEOptions = {
    reading: katakana ? 'katakana' : 'hiragana',
    output: { text:true, reading:true, tokens:true, ruby:true, source:true },
  };
  const { ref, result, clear } = useFuriIME(options);
  return (
    <main style={{ maxWidth: 740, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>FuriIME · React + Vite</h1>
      <textarea ref={ref} placeholder="とうきょう → 東京" rows={4} style={{ width: '100%' }} />
      <p>
        <label>
          <input type="checkbox" checked={katakana} onChange={e => setKatakana(e.target.checked)} />
          Katakana output
        </label>
      </p>
      <div style={{ fontSize: 24, lineHeight: 3 }} dangerouslySetInnerHTML={{ __html: result?.ruby ?? '' }} />
      <pre>{JSON.stringify(result, null, 2)}</pre>
      <button type="button" onClick={clear}>Clear</button>
    </main>
  );
}
