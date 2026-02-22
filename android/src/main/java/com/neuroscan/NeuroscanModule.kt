package com.neuroscan

import com.facebook.react.bridge.ReactApplicationContext

class NeuroscanModule(reactContext: ReactApplicationContext) :
  NativeNeuroscanSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeNeuroscanSpec.NAME
  }
}
