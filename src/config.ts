// 公開して問題ない設定値（キーは含めない）
// GASのウェブアプリURL（LIFFでのログインに使う）
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtlgq1PFrKdC6BBuHr0q5NskVVpYcjyeaOgvwpLkoG32DVJ-qXoB3e09SZ4evKl8necg/exec';
// LINEログインチャネルで作ったLIFFアプリのID（空のときはLIFFを使わない）
export const LIFF_ID: string = import.meta.env.VITE_LIFF_ID || '';
