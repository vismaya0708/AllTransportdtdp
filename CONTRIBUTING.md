# Contributing

Thanks for helping improve All Transport Service.

## Before changing the project

- Keep the app usable on narrow mobile screens.
- Keep `index.html` in the repository root unless deployment configuration is updated.
- Use relative paths for local assets so GitHub Pages project URLs work.
- Do not add secrets, passwords, private student information or API keys to the repository.
- Verify transport data against official sources before presenting it as current.

## Testing checklist

- Open the app in a modern mobile and desktop browser.
- Check navigation and interactive controls.
- Check the browser console for errors.
- Test the site on its GitHub Pages URL, not only with a local file.
- If changing offline assets, update the cache version in `service-worker.js`.
