require "json"
# Load the package.json once so we can reuse its data.
package = JSON.parse(File.read(File.join(__dir__, "package.json")))
repository = package["repository"]
repository_url = repository.is_a?(Hash) ? repository["url"] : repository

# Load the helper that computes the pre‑built path.
require_relative "./prebuilt-utils.rb"

Pod::Spec.new do |s|
  s.name            = "react-native-godot"
  s.version         = package["version"]
  s.summary         = package["description"]
  s.description     = package["description"]
  s.homepage        = package["homepage"]
  s.license         = package["license"]
  s.platforms       = { :ios => "15.0" }
  s.author          = package["author"]
  s.source          = { :git => repository_url, :tag => "v#{s.version}" }
  s.frameworks = 'AVFAudio'

  # Vendored frameworks are taken from the pre‑built location.
  # Using the helper ensures the path stays in sync with package.json.
  s.vendored_frameworks = [
    File.join(prebuilt_path("libgodot"), "libgodot.xcframework"),
    File.join(prebuilt_path("libgodot-cpp"), "libgodot-cpp.xcframework")
  ]

  s.weak_frameworks = 'libgodot'

  s.source_files    = ["ios/**/*.{h,hpp,cpp,m,mm,swift}"]
  s.header_mappings_dir = 'ios'

  s.subspec 'Cpp' do |cs|
    cs.source_files = ["cpp/**/*.{h,hpp,c,cpp,inc}"]
    cs.header_mappings_dir = 'cpp'
  end

  install_modules_dependencies(s)
  s.dependency 'RNWorklets'
end
