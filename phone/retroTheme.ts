import { StyleSheet } from 'react-native'

export const retro = {
  ink: '#1c1b1a', cream: '#f7ebdf', paper: '#fffaf3', blue: '#91c3ff',
  pink: '#ff9294', teal: '#32b8ae', orange: '#ffaf18', muted: '#524b45',
  disabled: '#ded8d0',
} as const

export const retroStyles = StyleSheet.create({
  shadow: { shadowColor: retro.ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOpacity: 0, elevation: 0 },
})
