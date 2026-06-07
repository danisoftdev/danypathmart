import { useEffect, useRef, useState } from 'react';

/**
 * Six auto-advancing single-character inputs. Calls onComplete(code) once all
 * boxes are filled. Supports paste and backspace navigation.
 */
export default function OTPInput({ length = 6, onComplete, disabled = false }) {
  const [vals, setVals] = useState(() => Array(length).fill(''));
  const refs = useRef([]);

  useEffect(() => {
    const code = vals.join('');
    if (code.length === length && vals.every((d) => d !== '')) {
      onComplete?.(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals]);

  const handleChange = (index, event) => {
    const raw = event.target.value.replace(/\D/g, '');
    if (raw === '') {
      setVals((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    if (raw.length > 1) {
      const chars = raw.slice(0, length).split('');
      setVals((prev) => {
        const next = [...prev];
        for (let k = 0; k < chars.length && index + k < length; k += 1) {
          next[index + k] = chars[k];
        }
        return next;
      });
      refs.current[Math.min(index + raw.length, length - 1)]?.focus();
      return;
    }
    setVals((prev) => {
      const next = [...prev];
      next[index] = raw;
      return next;
    });
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && vals[index] === '' && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const chars = pasted.split('');
    setVals((prev) => {
      const next = [...prev];
      chars.forEach((c, i) => {
        next[i] = c;
      });
      return next;
    });
    refs.current[Math.min(chars.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {vals.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={`h-14 w-11 rounded-xl border-2 bg-white text-center text-2xl font-bold text-[#111111] shadow-sm outline-none transition sm:h-16 sm:w-14 sm:text-3xl dark:bg-[#1E1E1E] dark:text-white ${
            digit
              ? 'border-brand-green ring-2 ring-brand-green/20'
              : 'border-[#E5E7EB] focus:border-brand-green focus:ring-4 focus:ring-brand-green/15 dark:border-white/15'
          } disabled:opacity-60`}
        />
      ))}
    </div>
  );
}
