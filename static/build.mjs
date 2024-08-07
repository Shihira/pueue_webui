import * as esbuild from 'esbuild'
import {sassPlugin} from 'esbuild-sass-plugin'

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function generateViewsIndex() {
    const views_dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'views');
    //console.log(views_dir);

    const views = fs.readdirSync(views_dir)
        .filter((x) => x.endsWith('-view.tsx') && x !== 'pueue-view.tsx')
        .map((x) => path.parse(x).name)
        .filter((x) => x !== 'index');
    const importViews = views.map((x, i) => `import * as view_${i} from './${x}'`);
    const exportedViews = views.map((_, i) => `    view_${i}.exportedView,`);

    const finalIndex = [
        ...importViews,
        'export const views = [',
        ...exportedViews,
        '];'
    ].join('\n');

    fs.writeFileSync(path.join(views_dir, 'index.tsx'), finalIndex);
}

generateViewsIndex();

await esbuild.build({
    bundle: true,
    entryPoints: ['index.tsx'],
    external: ['*.woff', '*.woff2', '*.jpg', '*.svg', '../../assets*'],
    plugins: [
        sassPlugin()
    ],
    outdir: './dist'
})

export { generateViewsIndex };

