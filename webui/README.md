# WebUI для OpenMOSS

Шаблон для разработки Vue 3 + Vite.

## Рекомендуемая настройка IDE

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (отключите Vetur).

## Рекомендуемая настройка браузера

- Chromium-based браузеры (Chrome, Edge, Brave и т.д.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Включите Custom Object Formatter в DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## TypeScript для `.vue` импортов

TypeScript не понимает типы `.vue` файлов по умолчанию, поэтому используем `vue-tsc` вместо `tsc` для проверки типов. В редакторах нужен [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar).

## Настройка

См. [Vite Configuration Reference](https://vite.dev/config/).

## Установка проекта

```sh
npm install
```

### Компиляция и горячая перезагрузка для разработки

```sh
npm run dev
```

### Проверка типов, компиляция и минификация для продакшена

```sh
npm run build
```

### Линтинг с [ESLint](https://eslint.org/)

```sh
npm run lint
```
