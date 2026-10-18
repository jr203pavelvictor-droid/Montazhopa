# Монтажопа / Montazhopa

Персональная CEP-панель для Adobe Premiere Pro. Версия **3.1.0-beta.1**.

Движение, камера, библиотека, звук, папки, эффекты и локальные монтажные инструменты в одном интерфейсе.

- [Публикация в GitHub и обновления](GITHUB_RU.md)
- [Установка и использование](START_HERE_RU.md)
- [Локальная нарезка и субтитры](LOCAL_TOOLS_RU.md)
- [Реальный состав и ограничения](FEATURES.md)
- [История изменений](CHANGELOG.md)
- [Авторы и лицензии](THIRD_PARTY_NOTICES.md)
- [Проверки](VALIDATION.md)

Сборка: `python3 tools/build_release.py`. ZIP в `dist` прикрепляется к GitHub Release с тегом `v` + версия из version.json. Панель читает опубликованные Releases, а не архив Source code.

Проверки без Premiere:
```bash
node tests/core.test.cjs
node --test tests/upstream/syncitol.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Результат — тестовая сборка, а не подтверждение работы всех CEP/QE API на каждой версии Premiere. Подробности в FEATURES.md и VALIDATION.md.
