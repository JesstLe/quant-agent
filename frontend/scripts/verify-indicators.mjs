import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const indicatorsPath = path.join(projectRoot, 'src', 'utils', 'indicators.ts')
const source = fs.readFileSync(indicatorsPath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
})

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quant-agent-indicators-'))
const tempModulePath = path.join(tempDir, 'indicators.mjs')
fs.writeFileSync(tempModulePath, transpiled.outputText, 'utf8')

const { calculateRSI, calculateMACD } = await import(pathToFileURL(tempModulePath).href)

function calculateReferenceRSI(data, period = 14) {
  const result = Array(data.length).fill(null)
  const gains = []
  const losses = []

  for (let i = 1; i < data.length; i += 1) {
    const change = data[i] - data[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  let avgGain = gains.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < data.length; i += 1) {
    avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period
    avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}

function calculateReferenceEMA(data, period) {
  const result = Array(data.length).fill(null)
  const multiplier = 2 / (period + 1)

  for (let i = period - 1; i < data.length; i += 1) {
    if (i === period - 1) {
      const sum = data.slice(0, period).reduce((acc, value) => acc + value, 0)
      result[i] = sum / period
    } else {
      result[i] = ((data[i] - result[i - 1]) * multiplier) + result[i - 1]
    }
  }

  return result
}

function calculateReferenceMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fast = calculateReferenceEMA(data, fastPeriod)
  const slow = calculateReferenceEMA(data, slowPeriod)
  const macd = Array(data.length).fill(null)

  for (let i = 0; i < data.length; i += 1) {
    if (fast[i] !== null && slow[i] !== null) {
      macd[i] = fast[i] - slow[i]
    }
  }

  const signal = Array(data.length).fill(null)
  const validMacd = []
  const multiplier = 2 / (signalPeriod + 1)

  for (let i = 0; i < macd.length; i += 1) {
    if (macd[i] === null) {
      continue
    }

    validMacd.push(macd[i])
    if (validMacd.length < signalPeriod) {
      continue
    }

    if (validMacd.length === signalPeriod) {
      signal[i] = validMacd.reduce((sum, value) => sum + value, 0) / signalPeriod
      continue
    }

    signal[i] = ((macd[i] - signal[i - 1]) * multiplier) + signal[i - 1]
  }

  return macd.map((value, index) => ({
    macd: value,
    signal: signal[index],
    histogram: value !== null && signal[index] !== null ? value - signal[index] : null,
  }))
}

function approximatelyEqual(a, b, epsilon = 1e-8) {
  if (a === null || b === null) {
    return a === b
  }

  return Math.abs(a - b) <= epsilon
}

function verifyRSI() {
  const sample = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
    45.89, 46.03, 45.61, 46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64,
    46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
    43.42, 42.66, 43.13,
  ]

  const actual = calculateRSI(sample, 14)
  const expected = calculateReferenceRSI(sample, 14)

  expected.forEach((value, index) => {
    assert.ok(
      approximatelyEqual(actual[index], value, 1e-6),
      `RSI mismatch at index ${index}: expected ${value}, received ${actual[index]}`
    )
  })
}

function verifyMACD() {
  const sample = Array.from({ length: 60 }, (_, index) => 100 + Math.sin(index / 4) * 6 + index * 0.35)
  const actual = calculateMACD(sample, 12, 26, 9)
  const expected = calculateReferenceMACD(sample, 12, 26, 9)

  for (let i = 0; i < 25; i += 1) {
    assert.equal(actual[i].macd, null, `MACD warmup should be null at index ${i}`)
  }

  for (let i = 0; i < 33; i += 1) {
    assert.equal(actual[i].signal, null, `Signal warmup should be null at index ${i}`)
    assert.equal(actual[i].histogram, null, `Histogram warmup should be null at index ${i}`)
  }

  expected.forEach((value, index) => {
    assert.ok(
      approximatelyEqual(actual[index].macd, value.macd, 1e-8),
      `MACD mismatch at index ${index}: expected ${value.macd}, received ${actual[index].macd}`
    )
    assert.ok(
      approximatelyEqual(actual[index].signal, value.signal, 1e-8),
      `Signal mismatch at index ${index}: expected ${value.signal}, received ${actual[index].signal}`
    )
    assert.ok(
      approximatelyEqual(actual[index].histogram, value.histogram, 1e-8),
      `Histogram mismatch at index ${index}: expected ${value.histogram}, received ${actual[index].histogram}`
    )
  })
}

verifyRSI()
verifyMACD()

console.log('Indicator verification passed.')
