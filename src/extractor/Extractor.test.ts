import { S3Client  } from '@aws-sdk/client-s3'
import { Extractor } from "./Extractor";

describe('Extractor utility', () => {
  const extractor = new Extractor({})
  test('can init', () => {
    expect(extractor).toBeDefined()
    expect(extractor._getTempDirectory()).toBeTruthy()
    expect(extractor._getS3Client()).toBeInstanceOf(S3Client)
  })

  test('can pull a filename from a URL-like string', () => {
    const baseURL = 'https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads'
    const expected1 = `sourPatch.csv.gz`
    const input1 = `${baseURL}/${expected1}`
    const expected2 = `reesesCups.csv.gz`
    const input2 = `${baseURL}/${expected2}`

    const value1 = extractor._extractFileNameFromURL(input1)
    expect(value1).toEqual(expected1)
    
    const value2 = extractor._extractFileNameFromURL(input2)
    expect(value2).toEqual(expected2)
  })

  test('', () => {})
  test('', () => {})
  test('', () => {})
  test('', () => {})
  test('', () => {})
  test('', () => {})
  test('', () => {})
})