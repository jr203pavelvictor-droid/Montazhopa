# ALTO 4.0.0-alpha.1 — 2026-10-19

Рабочая ветка без публикации: [дизайн, UX и сохранение совместимости](docs/ALTO_4_0_CHANGELOG.md). Публичное имя ALTO; прежние технические ID и обновлятор сохранены.

# 3.2.0-beta.2 — 2026-10-19

- Motion Zoom: «Взять кадр с таймлайна» captures the active sequence at the playhead and loads the image automatically.
- PNG signature, dimensions and browser decoding are verified. False QE return values are not confused with missing files; delayed output is polled for up to 5 seconds.
- A moving playhead / sequence change rejects stale output. Existing reference remains on failure. No timeline, In/Out, effects, track visibility or playhead mutations.
- Private temporary paths and exact-ticket cleanup; no Desktop/Finder screenshot steps, network upload or Media Encoder dialogs.
- Still contains visible effects. Capture an overview frame for accurate route placement. Live Premiere QE export validation is pending.

# 3.2.0-beta.1 — 2026-10-19

- Two native position keys for Move, verified Bezier/readback and transactional paired transitions.
- Eight directions; default edge protection with per-frame readback and conservative geometry checks.
- Animation, Transitions, Effects and Motion Zoom categories; category-aware custom preset import.
- Plain wordmark, new timeline/peach SVG mark, MOVE preview text, single-player audio hover.
- Retains beta 2 absolute-path bundled JSX bootstrap and adds its regression tests to CI.
- Version bumps on main now build and publish a new release only after regression and package checks.
- See [iteration notes and limitations](docs/ITERATION_1_RU.md). Premiere render validation remains pending.

# Montazhopa 3.1.0-beta.1

- Больше стекла: прозрачные поверхности, светлые грани, blur, контрастный фон и светлая активная вкладка. Привычная структура сохранена.
- Реальный перенос аудиоплеера VibeTools/Jungle: waveform, позиция, громкость, pitch, reverse, явный экспорт обработанного WAV.
- Подключены OpenCutz: черновой монтаж по тишине в новую XML-секвенцию, локальная транскрипция, редактирование текста, SRT и подсказки повторов. Требуют отдельно настроенные локальные инструменты.
- Подключён DSP Syncitol: расчёт сдвига двух записей для ручного совмещения.
- Улучшены наблюдение за папками, подпапки, дедупликация, повтор импорта и история для отдельных проектов.
- Добавлен поиск файлов пресетов Premiere; параметры импортируются стандартными средствами Premiere.
- Подключён адаптированный GitHub releases client PR Extension. Beta-channel, точный release asset, ограничение загрузки, проверка состава и контрольных сумм, подготовка установки и откат.
- Добавлены сборка релиза, GitHub Actions, лицензии, история происхождения файлов и инструкции.

Это CEP beta для испытаний. Windows/macOS-установщики и действия внутри настоящего Premiere в среде разработки не запускались. AI-модель и нативные бинарники в ZIP не включены. Состав и ограничения перечислены в FEATURES.md.
