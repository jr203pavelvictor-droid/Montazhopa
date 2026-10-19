# ALTO 4.0.0-beta.1

CEP-панель для Premiere Pro на основе Montazhopa. Новый интерфейс следует двум пользовательским референсам: полупрозрачное графитовое стекло в духе iOS и знак A из трёх плавных металлических лент. Основной шрифт — локальный Montserrat RU/EN.

[Скачать ALTO 4.0.0-beta.1](https://github.com/jr203pavelvictor-droid/Montazhopa/releases/tag/v4.0.0-beta.1) · [Изменения](docs/ALTO_4_0_CHANGELOG.md) · [Проверки и ограничения](docs/ALTO_4_0_QA.md)

![ALTO / Liquid Graphite](docs/previews/alto-motion-420.png)

- Хромированный изогнутый знак и открытая A в надписи ALTO; SVG и app icons 16–512 px.
- Стеклянные панели с бликами и глубиной; синие действия, зелёные переключатели, круглые кнопки и ползунки с индикацией значения.
- Главная, поиск по разделам, закреплённые команды, недавнее и сохранение контекста.
- Motion Zoom: Ease In / Ease Out, существующий маршрут и кнопка захвата кадра.
- Сохранены прежние инструменты, CEP ID, настройки, избранное, библиотека, watch folders, ownership/rollback и формат обновлений.

Обновление из прежней панели: Настройки → разрешить интернет и тестовые версии → Проверить → Загрузить и подготовить → Установить после закрытия Premiere. Можно также установить ZIP из Releases. Архив `Source code` не является пакетом обновления.

Публичное имя панели — **ALTO**. Репозиторий, `com.victor.motionviewer`, папка `Montazhopa3` и имя пакета `Montazhopa_<version>.zip` сохранены для совместимости.

[Существующие инструменты](FEATURES.md) · [Ограничения Premiere](docs/ITERATION_1_RU.md) · [Локальная обработка](LOCAL_TOOLS_RU.md) · [Лицензии](THIRD_PARTY_NOTICES.md)

Локальная сборка: `python3 tools/build_release.py`. Проверки браузера требуют Playwright 1.51.1.

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

Это бета-версия. Проверки используют настоящий HTML/CSS в Chromium и модель API Premiere. Живой рендер, CEP/QE и нативная установка на macOS/Windows в этой среде не проверялись.
