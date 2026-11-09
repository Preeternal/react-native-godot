/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@preeternal/react-native-godot';
import { Alert, Button, StyleSheet, View, Platform } from 'react-native';
import { MainBundlePath } from '@dr.pogodin/react-native-fs';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  MainWindow: undefined;
  SubWindow: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function initGodot(name: string) {
  const args =
    Platform.OS === 'android'
      ? ['--path', '/' + name]
      : ['--main-pack', `${MainBundlePath}/${name}.pck`];
  args.push('--verbose', '--display-driver', 'embedded');
  if (Platform.OS === 'android') {
    args.push(
      '--rendering-driver',
      'opengl3',
      '--rendering-method',
      'gl_compatibility'
    );
  }
  // The iOS bridge chooses Metal on devices and OpenGL in Simulator before create.

  runOnGodotThread(() => {
    'worklet';

    if (RTNGodot.getInstance() != null) return;
    if (RTNGodot.createInstance(args) == null) {
      throw new Error(
        'Godot initialization failed. See the native engine log for details.'
      );
    }
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert('Godot failed to start', message, [{ text: 'OK' }]);
  });
}

function pauseGodot() {
  RTNGodot.pause();
}

function resumeGodot() {
  RTNGodot.resume();
}

function destroyGodot() {
  runOnGodotThread(() => {
    'worklet';
    RTNGodot.destroyInstance();
  });
}

export interface AppController {
  open_window(windowName: string): void;
  close_window(windowName: string): void;
}

const instance = () => {
  'worklet';

  return RTNGodot.getInstance();
};

const appController = () => {
  'worklet';
  if (!instance()) return null;

  const Godot = RTNGodot.API();
  const engine = Godot.Engine;
  const sceneTree = engine.get_main_loop();
  if (!sceneTree) return null;

  const root = sceneTree.get_root();
  if (!root) return null;

  const controller = root.find_child(
    'AppController',
    true,
    false
  ) as AppController;

  if (!controller) return null;

  return controller;
};

function openSubwindow() {
  runOnGodotThread(() => {
    'worklet';
    const controller = appController();
    if (!controller) return;
    controller.open_window('subwindow');
  });
}

function closeSubwindow() {
  runOnGodotThread(() => {
    'worklet';
    const controller = appController();
    if (!controller) return;
    controller.close_window('subwindow');
  });
}

function MainWindow({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'MainWindow'>) {
  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Start 1" onPress={() => initGodot('GodotTest')} />
        <Button title="Start 2" onPress={() => initGodot('GodotTest2')} />
        <Button title="Stop" onPress={destroyGodot} />
        <Button title="Pause" onPress={pauseGodot} />
        <Button title="Resume" onPress={resumeGodot} />
        <Button
          title="Open Window"
          onPress={() => {
            navigation.navigate('SubWindow');
          }}
        />
      </View>
      <View style={styles.godotContainer}>
        <RTNGodotView style={styles.godot} />
      </View>
    </View>
  );
}

function SubWindow({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'SubWindow'>) {
  useEffect(() => {
    openSubwindow();
    return closeSubwindow;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Close" onPress={navigation.goBack} />
      </View>
      <View style={styles.godotContainer}>
        <RTNGodotView style={styles.godot} windowName="subwindow" />
      </View>
    </View>
  );
}

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MainWindow">
        <Stack.Screen name="MainWindow" component={MainWindow} />
        <Stack.Screen
          name="SubWindow"
          component={SubWindow}
          options={{
            headerBackVisible: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    flexDirection: 'column',
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
  },
  godotContainer: {
    flex: 8,
    padding: 20,
  },
  godot: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
});

export default App;
