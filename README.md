# ALTO 4.0 — development branch

Premiere Pro CEP-панель на основе Montazhopa 3.2.0-beta.2. Ветка `feature/alto-4-ui`: новый графитовый интерфейс со стеклом, локальный Montserrat и серебристый знак A из трёх восходящих уровней.

**4.0.0-dev.1 — рабочая версия для ревью, не опубликованный выпуск.** `main`, теги и Releases этой работой не обновляются. Последний опубликованный выпуск: [Montazhopa 3.2.0-beta.2](https://github.com/jr203pavelvictor-droid/Montazhopa/releases/tag/v3.2.0-beta.2).

- [Что реализовано и что отложено](docs/ALTO_4_0_CHANGELOG.md)
- [Визуальная система и логотип](docs/ALTO_4_0_BRAND.md)
- [Проверки и ограничения](docs/ALTO_4_0_QA.md)
- [Исходный план и приоритеты](docs/ALTO_4_0_MASTER_PLAN_RU.md)
- [Существующие инструменты](FEATURES.md) · [Ограничения Premiere](docs/ITERATION_1_RU.md)
- [Локальная обработка](LOCAL_TOOLS_RU.md) · [Лицензии](THIRD_PARTY_NOTICES.md)

![ALTO — каталог, 420 px](docs/previews/alto-motion-420.png)

Прежние CEP ID, ключи настроек, пользовательские файлы, Project bin paths, формат пресетов и механизм обновлений сохранены. Репозиторий пока называется `Montazhopa`, публичное имя панели — **ALTO**.

Локальная сборка: `python3 tools/build_release.py`. Историческое имя ZIP `Montazhopa_<version>.zip` сохранено для совместимости существующего обновлятора. Команда создаёт локальный пакет и не публикует его.

Проверки браузера требуют Playwright 1.51.1 (`npm install --no-save --ignore-scripts playwright@1.51.1`, `npx playwright install chromium`). Запуск:

```bash
node tests/engine.cjs
node tests/host.cjs
node tests/iteration1.cjs
node tests/frame-capture.cjs
node tests/bridge.test.cjs
node tests/local.cjs
node tests/core.test.cjs
node --test tests/upstream/syncitol.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/ui.cjs
node tests/alto-ui.cjs
```

Тесты используют браузер и модель API Premiere. Живое применение, рендер и установка в Premiere на macOS/Windows требуют отдельной проверки перед выпуском.
