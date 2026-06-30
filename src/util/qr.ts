import qrcode from 'qrcode-terminal';

export function renderQr(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (out: string) => resolve(out));
  });
}
