# Deploy PathSignal on Vercel

The user-selected production host is Vercel. Do not publish future updates to ChatGPT Sites.

- Public URL — https://pathsignal-six.vercel.app
- Vercel project — `pathsignal`
- Team — `pixels7`
- Project ID — `prj_pc4XbVlmInLl8U9QgX0Gcm6V54ZY`
- Framework — Other / static
- Install — `npm ci`
- Build — `npm run build`
- Output — `dist`

From this directory, deploy with `npx vercel deploy --scope pixels7 --project pathsignal --prod --yes --archive=tgz`. The parent folder contains `Deploy PathSignal Vercel.cmd` for the same action. Vercel CLI must be signed into an account with access to this team. No API keys are needed by the running application. Model files and browser runtime are bundled during the build.

`vercel.json` configures the build and caching. `.vercelignore` excludes local dependencies, generated outputs, review screenshots and the previous host's identity. The `.openai/hosting.json` file is retained as historical local metadata and is not the selected deployment target.

The iPhone Expo application is a separate project in `../phone`. To load its UI changes, run `npx expo start --go --clear` there and reopen the QR code in Expo Go. Website deployment does not update an already-open Expo session.

The YOLOX model is served in 2 MB SHA-256-checked chunks, with up to four downloads in parallel and visible progress. The loading deadline is ten minutes to accommodate slow connections. Initial download time depends on the network; inference after initialization runs on the device. The Expo app retains its separately bundled model.

