# Frame capture tests for 3.2.0-beta.2

`node tests/frame-capture.cjs`: verifies QE receipts (false/true/throw output), pending files, PNG headers and dimensions, stale sequence/playhead rejection, Unicode paths, private ticket cleanup and bounded non-symlink CEP loading.

Browser UI test: one-click reference loading, decoded dimensions, ticket cleanup, and preservation of the old image on a later capture error. Live Premiere export remains unverified.

---

# Validation for 3.2.0-beta.1

- `node tests/iteration1.cjs`: native endpoint key counts, all eight directions with every-frame coverage at 60 fps, portrait geometry, unsupported Motion preflight, ignored-Bezier rejection, shared-cut OUT/IN timing, invalid-selection rejection and rollback across two clips.
- Existing engine, host, bridge, local/updater, original Syncitol and Python worker tests are retained.
- `tools/build_release.py` bundles JSX, enforces matching app/host/CEP versions, builds a deterministic update archive and SHA-256. CI runs these tests before publication.
- Tests using the Premiere DOM are simulations. No live Premiere installation or Windows/macOS installer execution is available in this environment.
- Browser UI verification status is recorded in the iteration test output / CI, separate from host simulation and real Premiere render validation.

---

# Проверки 3.1.0-beta.1

Проверено 18 октября 2026 в Linux-среде разработки. Результаты относятся к указанным уровням проверки.

| Проверка | Результат |
| --- | --- |
| Оригинальные DSP-тесты Syncitol на включённом модуле | 155 passed, 0 failed |
| Python worker, 5 проверок | Пройдены: Unicode SRT и округление, запрет пересекающихся/NaN-интервалов, русские повторы, настоящий WAV → речь → корректный XML, явная ошибка FFmpeg при повреждённом аудио |
| Реальный FFmpeg на синтетическом 4-секундном WAV | Найдены два участка речи; итоговая XML-секвенция около 2 секунд. XML разбирается стандартным XML-парсером; путь с кириллицей и # корректно кодируется |
| JavaScript/JSX syntax | 19 runtime-файлов разобраны парсером; препроцессорные #include исключены только для проверки синтаксиса |
| Каналы обновлений | На моделях API: стабильные/beta, исключение draft и ZIP исходников, отсутствие сети при выключенном разрешении |
| ZIP и staging | Запрет path traversal, опасных имён, дубликатов регистра, повреждённых данных, отсутствующих файлов и неверных SHA. Текущая папка сохраняется при подготовке. Изменение staged-файлов блокирует установку |
| Установщик обновления | Создание detached shell-script проверено с подставным process launcher, без фактического запуска. Синтаксис shell проверен sh -n; повторный запуск блокируется. Полный реальный процесс замены панели не выполнялся |
| Watcher | На настоящих временных файлах: ACK, повтор после ошибки, рекурсивные подпапки и раздельная история двух проектов |
| QE regression | Модель дорожки с пустотой: выбран нужный клип по имени/времени. При неоднозначности операция отклоняется |
| UI | 14 экранов × 3 ширины: 320, 420, 900 px, без горизонтального переполнения и runtime exceptions. Chromium 143 через Playwright; это не встроенный CEF Premiere |
| Аудиоплеер | Оригинальный адаптированный VibeTools player: реальное PCM через Web Audio, waveform, воспроизведение, pitch/reverse, открытие/закрытие |
| Синхронизация через интерфейс | Два реальных тестовых WAV с задержкой 0.5s → Syncitol находит 0.5s с высокой корреляцией |
| ZIP выпуска | Полный CRC, совпадение всех runtime SHA-256, согласованность bundle/version, подготовка обновления оригинальным кодом 3.0 beta 1 и новым кодом |

## Не проверено в этой среде

- Запуск расширения и рендер/изменение таймлайна внутри настоящего Premiere.
- Установка/замена/откат настоящих папок CEP на Windows или macOS; PowerShell под Windows и доступ на управляемом рабочем Mac.
- Настоящая публикация в репозитории пользователя, GitHub Actions и скачивание его release asset.
- Установка faster-whisper и распознавание реальной речи загруженной моделью. ASR-адаптер присутствует, но модель не скачивалась и GPU не тестировался.
- Экспорт pitch через FFmpeg rubberband на пользовательских сборках FFmpeg.
- Нативные DLL/importer/UXP addon: в этой версии не поставляются.

Интерфейс, зависимости и формат проекта могут отличаться по версиям Premiere. Бета предназначена для проверки на копии проекта. Подтверждённые локальные проверки не выдаются за тест Premiere на обеих ОС.
