import { describe, expect, it } from 'vitest'
import { readPackedTarballName } from './piece-utils'

describe('readPackedTarballName', () => {
    it('reads the array output of npm <= 11', () => {
        const stdout = JSON.stringify([{ filename: 'attunesolutions-piece-echoback-0.0.2.tgz' }])
        expect(readPackedTarballName(stdout)).toBe('attunesolutions-piece-echoback-0.0.2.tgz')
    })

    it('reads the name-keyed object output of npm >= 12', () => {
        const stdout = JSON.stringify({
            '@attunesolutions/piece-echoback': { filename: 'attunesolutions-piece-echoback-0.0.2.tgz' },
        })
        expect(readPackedTarballName(stdout)).toBe('attunesolutions-piece-echoback-0.0.2.tgz')
    })

    it('throws when no tarball name is present', () => {
        expect(() => readPackedTarballName('{}')).toThrow(/npm pack --json/)
    })
})
