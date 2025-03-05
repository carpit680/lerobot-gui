# factory.py
try:
    from openbot.impl.cpp_impl_wrapper import CppDataProcessor
    implementation = CppDataProcessor
except ImportError:
    from openbot.impl.python_impl import PythonDataProcessor
    implementation = PythonDataProcessor

def get_data_processor():
    return implementation()

