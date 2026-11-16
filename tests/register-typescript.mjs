import { registerHooks } from 'node:module';
import { extname } from 'node:path';

// Creator resolves extensionless TypeScript source imports. Keep Node's real-module tests equivalent.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/game/assets/scripts/') && specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(specifier+'.ts',context);
    }
    return nextResolve(specifier,context);
  },
});
