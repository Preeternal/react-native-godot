# React Native Godot example

Это пример на шаблоне React Native Community CLI с React Native `0.88.0` и
React `19.3.0`. Он показывает запуск двух Godot-проектов, управление
жизненным циклом Godot и открытие подокна через React Navigation native stack.

Основной код находится в [`src/App.tsx`](src/App.tsx). Для чтения PCK на iOS
используется `@dr.pogodin/react-native-fs`; Android получает Godot-ресурсы из
`android/app/src/main/assets`.

## Подготовка Godot-ресурсов

Из каталога `example`:

```sh
./export_godot_GodotTest.sh ios
./export_godot_GodotTest2.sh ios
./export_godot_GodotTest.sh android
./export_godot_GodotTest2.sh android
```

Для нестандартной установки Godot укажи путь в `GODOT_EDITOR`.

## Установка и запуск

Из корня репозитория:

```sh
yarn install
yarn workspace @preeternal/react-native-godot-example start
```

В отдельном терминале:

```sh
yarn workspace @preeternal/react-native-godot-example ios
yarn workspace @preeternal/react-native-godot-example android
```

После изменения iOS-зависимостей:

```sh
cd example/ios
bundle install
bundle exec pod install
```

Проверка TypeScript:

```sh
yarn workspace @preeternal/react-native-godot-example typecheck
```

Нативные проекты, Metro-конфигурация, codegen-интеграция и команды сборки
сохранены из актуального RN CLI-шаблона. Пример не использует Expo,
`portal:`-зависимости или старый Expo entrypoint.
