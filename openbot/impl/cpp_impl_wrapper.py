# cpp_impl_wrapper.py
from openbot.interfaces.comm_interface import DataProcessor
import cpp_impl

class CppDataProcessor(DataProcessor):
    def process(self, data):
        return cpp_impl.process_cpp(data)

