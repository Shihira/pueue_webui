import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

await esbuild.build({
    bundle: true,
    entryPoints: ['index.tsx'],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'],
    plugins: [
        sassPlugin()
    ],
    outdir: './dist'
})

