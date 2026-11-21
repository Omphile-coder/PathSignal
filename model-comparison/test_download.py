import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import download_models as download

class DownloadChecks(unittest.TestCase):
    def test_artifact_download_and_credential_redaction(self):
        secret='test-private-key'
        metadata={'ort':{'model':'https://storage.example/model?token=one',
                         'environment':'https://storage.example/env?token=two',
                         'classes':['Downstair','Upstair']}}
        def json_response(url,headers=None):
            if '/ort/' in url:
                self.assertEqual(headers,{'Authorization':'Bearer '+secret})
                self.assertNotIn(secret,url)
                return metadata
            self.assertIsNone(headers)
            return {'PREPROCESSING':{'resize':{'format':'Stretch to'}},'api_key':secret,
                    'download':'https://storage.example/model?token=one'}
        response=io.BytesIO(b'fake-model-for-download-test');response.headers={'Content-Length':'28'}
        def get_weights(request,timeout):
            self.assertIsNone(request.get_header('Authorization'))
            return response
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with patch.object(download,'ARTIFACTS',root),patch.object(download,'read_json',side_effect=json_response),patch.object(download,'urlopen',side_effect=get_weights),patch.object(download,'inspect_model',return_value={'cpu_session_created':True}):
                row=download.fetch_model('Example','example/1',secret,'test-device')
            self.assertIn('weights',row)
            self.assertEqual(row['weights']['bytes'],28)
            for file in root.rglob('*.json'):
                content=file.read_text()
                self.assertNotIn(secret,content)
                self.assertNotIn('token=one',content)
                self.assertNotIn('token=two',content)

    def test_size_limit_cleans_partial_file(self):
        response=io.BytesIO(b'oversized');response.headers={}
        with tempfile.TemporaryDirectory() as temp:
            target=Path(temp)/'model.onnx'
            with patch.object(download,'urlopen',return_value=response),self.assertRaises(ValueError):
                download.fetch_weights('https://storage.example/model',target,max_bytes=2)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_suffix('.partial').exists())

    def test_reject_non_https_artifact(self):
        with self.assertRaises(ValueError):download.artifact_url('http://example.test/model')

if __name__=='__main__':unittest.main()
