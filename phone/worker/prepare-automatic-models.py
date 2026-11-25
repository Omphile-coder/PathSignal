"""Build smaller-input ONNX graphs for Automatic Scan using the existing weights."""

from pathlib import Path

import numpy as np
import onnx
from onnx import helper, numpy_helper

PHONE = Path(__file__).resolve().parents[1]
ASSETS = PHONE / "assets" / "model"
PAVING_SOURCE = (
    PHONE.parent / "presentation-site" / "source-model" / "footpath-damage" / "footpath-damage-deeplabv3.onnx"
)
OBJECT_SIZE = 480
PAVING_SIZE = 512
CROP_SIZE = 384
CROP_TOP = 112
CROP_LEFT = 64


def object_graph():
    model = onnx.load(ASSETS / "yolox_s.onnx")
    source = model.graph.input[0].type.tensor_type.shape.dim
    target = model.graph.output[0].type.tensor_type.shape.dim
    if [d.dim_value for d in source] != [1, 3, 640, 640] or [d.dim_value for d in target] != [1, 8400, 85]:
        raise ValueError("Unexpected YOLOX-S source model")
    for dim in source[-2:]:
        dim.dim_value = OBJECT_SIZE
    target[1].dim_value = sum((OBJECT_SIZE // stride) ** 2 for stride in (8, 16, 32))
    del model.graph.value_info[:]
    onnx.checker.check_model(model)
    onnx.save(model, ASSETS / "automatic-yolox-480.onnx")


def paving_graph():
    model = onnx.load(PAVING_SOURCE, load_external_data=False)
    graph = model.graph
    image = graph.input[0].name
    probability = graph.output[0].name
    dimensions = {value.name: [d.dim_value for d in value.type.tensor_type.shape.dim[-2:]]
                  for value in (graph.input[0], graph.output[0])}
    if dimensions != {"images": [PAVING_SIZE, PAVING_SIZE], "damage_probability": [PAVING_SIZE, PAVING_SIZE]}:
        raise ValueError("Unexpected source paving graph")

    tensors = {tensor.name: tensor for tensor in graph.initializer}
    for name, original, cropped in (
        ("val_647", PAVING_SIZE // 8, CROP_SIZE // 8),
        ("val_673", PAVING_SIZE, CROP_SIZE),
    ):
        tensor = tensors[name]
        if numpy_helper.to_array(tensor).tolist() != [original, original]:
            raise ValueError(f"Unexpected paving resize constant: {name}")
        tensor.CopyFrom(numpy_helper.from_array(np.array([cropped, cropped], dtype=np.int64), name))

    # Keep the model interface at 512 square. Crop pixels before expensive
    # convolutions and pad probabilities back to the original corridor coordinates.
    cropped_image = "pathsignal_cropped_image"
    cropped_probability = "pathsignal_cropped_probability"
    for node in graph.node:
        for index, source in enumerate(node.input):
            if source == image:
                node.input[index] = cropped_image
        for index, output in enumerate(node.output):
            if output == probability:
                node.output[index] = cropped_probability
    arrays = {
        "pathsignal_crop_start": [CROP_TOP, CROP_LEFT],
        "pathsignal_crop_end": [CROP_TOP + CROP_SIZE, CROP_LEFT + CROP_SIZE],
        "pathsignal_crop_axes": [2, 3],
        "pathsignal_padding": [0, 0, CROP_TOP, CROP_LEFT, 0, 0,
                               PAVING_SIZE - CROP_TOP - CROP_SIZE, PAVING_SIZE - CROP_LEFT - CROP_SIZE],
    }
    graph.initializer.extend(
        numpy_helper.from_array(np.array(settings, dtype=np.int64), name) for name, settings in arrays.items()
    )
    graph.node.insert(0, helper.make_node(
        "Slice", [image, "pathsignal_crop_start", "pathsignal_crop_end", "pathsignal_crop_axes"], [cropped_image]
    ))
    graph.node.append(helper.make_node("Pad", [cropped_probability, "pathsignal_padding"], [probability], mode="constant"))
    del graph.value_info[:]
    onnx.save(model, ASSETS / "automatic-paving-crop.onnx")


if __name__ == "__main__":
    object_graph()
    paving_graph()
