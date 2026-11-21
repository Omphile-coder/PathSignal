"""Credential-redaction and request-shape regression checks; no network access."""
import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
import check_access

class AccessChecks(unittest.TestCase):
    def test_artifact_request_and_safe_error(self):
        secret='test-secret+with/slash'
        def rejected(request,timeout):
            params=parse_qs(urlparse(request.full_url).query)
            self.assertEqual(params,{'nocache':['true'],'device':['example-device'],'dynamic':['true']})
            self.assertNotIn(secret,request.full_url)
            self.assertEqual(request.get_header('Authorization'),'Bearer '+secret)
            payload={'error':{'message':'Unsupported model; API key='+secret+'; https://example.test/?token=secret'}}
            raise HTTPError(request.full_url,400,'Bad Request',{},io.BytesIO(json.dumps(payload).encode()))
        with patch.object(check_access,'urlopen',rejected):
            result=check_access.check_model('Example','example/1',secret,'example-device')
        self.assertEqual(result['http_status'],400)
        self.assertIn('Unsupported model',result['diagnostic'])
        self.assertNotIn(secret,json.dumps(result))
        self.assertNotIn('token=secret',json.dumps(result))

    def test_success_does_not_save_artifact_urls(self):
        response=io.BytesIO(json.dumps({'ort':{'model':'https://example.test/signed?token=secret'}}).encode())
        response.status=200
        with patch.object(check_access,'urlopen',return_value=response):
            result=check_access.check_model('Example','example/1','test-key')
        self.assertEqual(result['http_status'],200)
        self.assertEqual(result['response_top_level_fields'],['ort'])
        self.assertNotIn('token=secret',json.dumps(result))

if __name__=='__main__': unittest.main()
