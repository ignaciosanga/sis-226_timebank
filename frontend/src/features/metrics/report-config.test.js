import test from 'node:test'
import assert from 'node:assert/strict'
import { lookerEmbedUrl, reportAccess } from './report-config.js'

test('accepts the Looker iframe src with a report, optional page and filters', () => {
  for (const value of [
    'https://lookerstudio.google.com/embed/reporting/abc-123',
    'https://lookerstudio.google.com/embed/reporting/abc-123/page/p_123?rm=minimal',
  ]) assert.equal(lookerEmbedUrl(` ${value} `), value)
})

test('does not embed empty, arbitrary, deceptive or pasted HTML sources', () => {
  for (const value of ['', undefined, 'javascript:alert(1)', 'http://lookerstudio.google.com/embed/reporting/report',
    'https://lookerstudio.google.com.evil.test/embed/reporting/report', 'https://example.com/embed/reporting/report',
    'https://lookerstudio.google.com/reporting/report', 'https://user:password@lookerstudio.google.com/embed/reporting/report',
    '<iframe src="https://lookerstudio.google.com/embed/reporting/report"></iframe>']) {
    assert.equal(lookerEmbedUrl(value), '', String(value))
  }
})

test('personal report needs a signed-in profile and loses access when the session ends', () => {
  const user = { id: 'student', rol: 'Estudiante', roles: ['ESTUDIANTE'] }
  assert.equal(reportAccess('student', { authenticated: false, user }), 'login')
  assert.equal(reportAccess('student', { authenticated: true, user: null }), 'login')
  assert.equal(reportAccess('student', { authenticated: true, user }), 'allowed')
})

test('a demo admin or regular student cannot open a configured admin iframe', () => {
  assert.equal(reportAccess('admin', { authenticated: false, user: { id: 'demo-admin', rol: 'Administrador' } }), 'login')
  assert.equal(reportAccess('admin', { authenticated: true, user: { id: 'student', roles: ['ESTUDIANTE'] } }), 'admin')
  assert.equal(reportAccess('admin', { authenticated: true, user: { id: 'admin', roles: ['ADMIN'] } }), 'allowed')
  assert.equal(reportAccess('admin', { authenticated: true, user: { id: 'admin', rol: 'Administrador' } }), 'allowed')
})
