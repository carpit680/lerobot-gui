import sys
import subprocess
import os
import re
from setuptools import setup, find_packages, Command
from setuptools.command.build_py import build_py as _build_py

def patch_all_proto_imports(proto_dir):
    """
    Recursively patch all generated *_pb2_grpc.py files in the given directory
    to use relative imports instead of absolute imports.
    """
    for root, dirs, files in os.walk(proto_dir):
        for file in files:
            if file.endswith("_pb2_grpc.py"):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                # This regex replaces lines like:
                #   import comm_pb2 as comm__pb2
                # with:
                #   from . import comm_pb2 as comm__pb2
                content_new = re.sub(
                    r"^import (\S+_pb2) as (\S+__pb2)",
                    r"from . import \1 as \2",
                    content,
                    flags=re.MULTILINE
                )
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content_new)

class GenerateProto(Command):
    description = "Generate gRPC Python code from all .proto files."
    user_options = []  # No command-line options needed

    def initialize_options(self):
        pass

    def finalize_options(self):
        pass

    def run(self):
        # Define the proto directory.
        proto_dir = os.path.join("openbot", "comm", "proto")
        if not os.path.isdir(proto_dir):
            print(f"Proto directory {proto_dir} not found.")
            return

        # Loop over all .proto files in the proto_dir.
        for filename in os.listdir(proto_dir):
            if filename.endswith(".proto"):
                proto_file = os.path.join(proto_dir, filename)
                command = [
                    sys.executable, "-m", "grpc_tools.protoc",
                    "-I" + proto_dir,
                    "--python_out=" + proto_dir,
                    "--grpc_python_out=" + proto_dir,
                    proto_file
                ]
                self.announce("Running: " + " ".join(command), level=3)
                subprocess.check_call(command)
        # Patch all generated grpc files to use relative imports.
        patch_all_proto_imports(proto_dir)

class build_py(_build_py):
    def run(self):
        self.run_command("generate_proto")
        _build_py.run(self)

setup(
    name="openbot",
    version="0.1.0",
    description="A modular SDK for Physical AI Robotics with device management, communication adapters, and more.",
    author="Arpit Chauhan",
    author_email="carpit680@gmail.com",
    url="https://github.com/carpit680/openbot-sdk",
    packages=find_packages(),
    install_requires=[
        "opencv-python>=4.5.0",
        "aiortc>=1.0.0",
        "grpcio>=1.44.0",
        "numpy>=1.21.0"
    ],
    extras_require={
        "dev": [
            "pytest>=8.0.0",
            "pytest-asyncio>=0.20.0",
            "grpcio-tools>=1.44.0"
        ]
    },
    cmdclass={
        "generate_proto": GenerateProto,
        "build_py": build_py,
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.10",
)
