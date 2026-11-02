import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),

		// Hosts like Jekyll skip folders starting with an underscore, such as the default _app
		appDir: 'app',

		// Subfolder hosting needs a base path, e.g. BASE_PATH=/sql.bz for user.github.io/sql.bz
		paths: { base: process.env.BASE_PATH ?? '' }
	}
};

export default config;
