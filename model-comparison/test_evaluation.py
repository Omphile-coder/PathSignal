import unittest
import numpy as np
from PIL import Image
from evaluate_models import decode, tensor_for

class EvaluationChecks(unittest.TestCase):
    def test_rgb_normalisation_and_stretch(self):
        image=Image.new('RGB',(2,1),(255,128,0))
        tensor,rgb=tensor_for(image,{'auto-orient':{'enabled':True},'resize':{'format':'Stretch to','width':4,'height':4}})
        self.assertEqual(tensor.shape,(1,3,4,4))
        np.testing.assert_allclose(tensor[0,:,0,0],[1,128/255,0],atol=1e-6)
        self.assertEqual(rgb.size,(2,1))

    def test_v5_objectness_class_score_and_scaling(self):
        output=np.array([[[320,320,160,160,.8,.1,.75],[320,320,160,160,.7,.1,.75],
                          [320,320,160,160,.4,.1,.75]]],dtype=np.float32)
        decoded=decode(output,'yolov5v6n',['Downstair','Upstair'],(320,640),(640,640))
        self.assertEqual(len(decoded),1)
        self.assertEqual(decoded[0]['class'],'Upstair')
        self.assertAlmostEqual(decoded[0]['score'],.6)
        self.assertEqual(decoded[0]['xyxy'],[120,240,200,400])
        self.assertTrue(decoded[0]['in_image_space_corridor'])

    def test_v8_has_no_objectness_column(self):
        output=np.array([[[320,20],[320,320],[80,10],[80,10],[.9,.8]]],dtype=np.float32)
        decoded=decode(output,'yolov8n',['stairs'],(640,640),(640,640))
        self.assertEqual(len(decoded),2)
        self.assertAlmostEqual(decoded[0]['score'],.9)
        self.assertTrue(decoded[0]['in_image_space_corridor'])
        self.assertFalse(decoded[1]['in_image_space_corridor'])

    def test_class_mapping_mismatch_stops_evaluation(self):
        with self.assertRaises(ValueError):decode(np.zeros((1,5,8400),dtype=np.float32),'yolov8n',['a','b'],(640,640),(640,640))

if __name__=='__main__':unittest.main()
